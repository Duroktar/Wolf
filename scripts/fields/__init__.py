"""
How it works: the library is composed of 2 major parts:

* The `sealers`. They return a class that implements a container according the given specification (list of field names
  and default values).
* The `factory`. A metaclass that implements attribute/item access, so you can do ``Fields.a.b.c``. On each
  getattr/getitem it returns a new instance with the new state. Its ``__new__`` method takes extra arguments to store
  the contruction state and it works in two ways:

  * Construction phase (there are no bases). Make new instances of the `Factory` with new state.
  * Usage phase. When subclassed (there are bases) it will use the sealer to return the final class.
"""
import linecache
import sys
from itertools import chain
from operator import itemgetter

import zlib

try:
    from collections import OrderedDict
except ImportError:
    from .py2ordereddict import OrderedDict

__version__ = "5.0.0"
__all__ = (
    'BareFields',
    'ComparableMixin',
    'ConvertibleFields',
    'ConvertibleMixin',
    'Fields',
    'PrintableMixin',
    'SlotsFields',
    'Tuple',
    # advanced stuff
    'factory',
    'make_init_func',
    'class_sealer',
    'slots_class_sealer',
    'tuple_sealer',
    # convenience things
    'Namespace'
)
PY2 = sys.version_info[0] == 2
MISSING = object()


def _with_metaclass(meta, *bases):
    # See: http://lucumr.pocoo.org/2013/5/21/porting-to-python-3-redux/#metaclass-syntax-changes

    class metaclass(meta):
        __call__ = type.__call__
        __init__ = type.__init__

        def __new__(cls, name, this_bases, d):
            if this_bases is None:
                return type.__new__(cls, name, (), d)
            return meta(name, bases, d)
    return metaclass('temporary_class', None, {})


class __base__(object):
    def __init__(self, *args, **kwargs):
        pass


def make_init_func(fields, defaults,
                   baseclass_name='FieldsBase',
                   header_name='__init__',
                   header_start='def {func_name}(self',
                   header_end='):\n',
                   super_call_start='super({baseclass_name}, self).__init__(',
                   super_call_end=')\n',
                   super_call=True,
                   super_call_pass_allargs=True,
                   super_call_pass_kwargs=True,
                   set_attributes=True):
    func_name = '__fields_init_for__{0}__'.format('__'.join(fields))
    parts = [header_start.format(func_name=func_name)]
    still_positional = True
    for var in fields:
        if var in defaults:
            still_positional = False
            parts.append(', {0}={0}'.format(var))
        elif still_positional:
            parts.append(', {0}'.format(var))
        else:
            raise ValueError("Cannot have positional fields after fields with defaults. "
                             "Field {0!r} is missing a default value!".format(var))
    parts.append(header_end if fields else header_end.lstrip(', '))
    if set_attributes:
        for var in fields:
            parts.append('    self.{0} = {0}\n'.format(var))
    if super_call:
        parts.append('    ')
        parts.append(super_call_start.format(baseclass_name=baseclass_name))
        if super_call_pass_allargs:
            if super_call_pass_kwargs:
                parts.append(', '.join('{0}={0}'.format(var) for var in fields))
            else:
                parts.append(', '.join('{0}'.format(var) for var in fields))
            parts.append(super_call_end)
        else:
            parts.append(super_call_end.lstrip(', '))
    local_namespace = dict(defaults)
    global_namespace = dict(super=super) if super_call else {}
    parts.append('{0} = {1}\ndel {1}'.format(header_name, func_name))
    code = ''.join(parts)

    filename = "<fields-init-function-%x>" % zlib.adler32(code.encode('utf8'))
    codeobj = compile(code, filename, 'exec')
    if PY2:
        exec("exec codeobj in global_namespace, local_namespace")
    else:
        exec(codeobj, global_namespace, local_namespace)
    linecache.cache[filename] = len(code), None, code.splitlines(), filename
    return global_namespace, local_namespace


def class_sealer(fields, defaults,
                 base=__base__, make_init_func=make_init_func,
                 initializer=True, comparable=True, printable=True, convertible=False, pass_kwargs=False):
    """
    This sealer makes a normal container class. It's mutable and supports arguments with default values.
    """
    baseclass_name = 'FieldsBase_for__{0}'.format('__'.join(fields))
    if pass_kwargs:
        options = dict(
            header_end=', **__fields_kwargs__):\n',
            super_call_end=', **__fields_kwargs__)\n',
            super_call_pass_allargs=False,
        )
    else:
        options = {}

    if initializer:
        global_namespace, local_namespace = make_init_func(fields, defaults, baseclass_name, **options)

    class FieldsBase(base):
        if initializer:
            __init__ = local_namespace['__init__']

        if comparable:
            def __eq__(self, other):
                if isinstance(other, self.__class__):
                    return tuple(getattr(self, a) for a in fields) == tuple(getattr(other, a) for a in fields)
                else:
                    return NotImplemented

            def __ne__(self, other):
                result = self.__eq__(other)
                if result is NotImplemented:
                    return NotImplemented
                else:
                    return not result

            def __lt__(self, other):
                if isinstance(other, self.__class__):
                    return tuple(getattr(self, a) for a in fields) < tuple(getattr(other, a) for a in fields)
                else:
                    return NotImplemented

            def __le__(self, other):
                if isinstance(other, self.__class__):
                    return tuple(getattr(self, a) for a in fields) <= tuple(getattr(other, a) for a in fields)
                else:
                    return NotImplemented

            def __gt__(self, other):
                if isinstance(other, self.__class__):
                    return tuple(getattr(self, a) for a in fields) > tuple(getattr(other, a) for a in fields)
                else:
                    return NotImplemented

            def __ge__(self, other):
                if isinstance(other, self.__class__):
                    return tuple(getattr(self, a) for a in fields) >= tuple(getattr(other, a) for a in fields)
                else:
                    return NotImplemented

            def __hash__(self):
                return hash(tuple(getattr(self, a) for a in fields))

        if printable:
            def __repr__(self):
                return "{0}({1})".format(
                    self.__class__.__name__,
                    ", ".join("{0}={1}".format(attr, repr(getattr(self, attr))) for attr in fields)
                )
        if convertible:
            @property
            def as_dict(self):
                return dict((attr, getattr(self, attr)) for attr in fields)

            @property
            def as_tuple(self):
                return tuple(getattr(self, attr) for attr in fields)

    if initializer:
        global_namespace[baseclass_name] = FieldsBase
    return FieldsBase


def slots_class_sealer(fields, defaults):
    """
    This sealer makes a container class that uses ``__slots__`` (it uses :func:`class_sealer` internally).

    The resulting class has a metaclass that forcibly sets ``__slots__`` on subclasses.
    """
    class __slots_meta__(type):
        def __new__(mcs, name, bases, namespace):
            if "__slots__" not in namespace:
                namespace["__slots__"] = fields
            return type.__new__(mcs, name, bases, namespace)

    class __slots_base__(_with_metaclass(__slots_meta__, object)):
        __slots__ = ()

        def __init__(self, *args, **kwargs):
            pass

    return class_sealer(fields, defaults, base=__slots_base__)


def tuple_sealer(fields, defaults):
    """
    This sealer returns an equivalent of a ``namedtuple``.
    """
    baseclass_name = 'FieldsBase_for__{0}'.format('__'.join(fields))
    global_namespace, local_namespace = make_init_func(
        fields, defaults, baseclass_name,
        header_name='__new__',
        header_start='def {func_name}(cls',
        header_end='):\n',
        super_call_start='return tuple.__new__(cls, (',
        super_call_end='))\n',
        super_call_pass_kwargs=False, set_attributes=False,
    )

    def __getnewargs__(self):
        return tuple(self)

    def __repr__(self):
        return "{0}({1})".format(
            self.__class__.__name__,
            ", ".join(a + "=" + repr(getattr(self, a)) for a in fields)
        )

    return type(baseclass_name, (tuple,), dict(
        [(name, property(itemgetter(i))) for i, name in enumerate(fields)],
        __new__=local_namespace['__new__'],
        __getnewargs__=__getnewargs__,
        __repr__=__repr__,
        __slots__=(),
    ))


class _SealerWrapper(object):
    """
    Primitive wrapper around a function that makes it `un-bindable`.

    When you add a function in the namespace of a class it will be bound (become a method) when you try to access it.
    This class prevents that.
    """
    def __init__(self, func, **kwargs):
        self.func = func
        self.kwargs = kwargs

    @property
    def __name__(self):
        return self.func.__name__

    def __call__(self, *args, **kwargs):
        return self.func(*args, **dict(self.kwargs, **kwargs))


class _Factory(type):
    """
    This class makes everything work. It a metaclass for the class that users are going to use. Each new chain
    rebuilds everything.
    """

    __required = ()
    __defaults = ()
    __all_fields = ()
    __last_field = None
    __full_required = ()
    __sealer = None
    __concrete = None

    def __getattr__(cls, name):
        if name.startswith("__") and name.endswith("__"):
            return type.__getattribute__(cls, name)
        if name in cls.__required:
            raise TypeError("Field %r is already specified as required." % name)
        if name in cls.__defaults:
            raise TypeError("Field %r is already specified with a default value (%r)." % (
                name, cls.__defaults[name]
            ))
        if name == cls.__last_field:
            raise TypeError("Field %r is already specified as required." % name)
        if cls.__defaults and cls.__last_field is not None:
            raise TypeError("Can't add required fields after fields with defaults.")

        return _Factory(
            required=cls.__full_required,
            defaults=cls.__defaults,
            last_field=name,
            sealer=cls.__sealer,
        )

    def __getitem__(cls, default):
        if cls.__last_field is None:
            raise TypeError("Can't set default %r. There's no previous field." % default)

        new_defaults = OrderedDict(cls.__defaults)
        new_defaults[cls.__last_field] = default
        return _Factory(
            required=cls.__required,
            defaults=new_defaults,
            sealer=cls.__sealer,
        )

    def __new__(mcs, name="__blank__", bases=(), namespace=None, last_field=None, required=(), defaults=(),
                sealer=_SealerWrapper(class_sealer)):

        if not bases:
            assert isinstance(sealer, _SealerWrapper)

            full_required = tuple(required)
            if last_field is not None:
                full_required += last_field,
            all_fields = list(chain(full_required, defaults))

            return type.__new__(
                _Factory,
                "Fields<{0}>.{1}".format(sealer.__name__, ".".join(all_fields))
                if all_fields else "Fields<{0}>".format(sealer.__name__),
                bases,
                dict(
                    _Factory__required=required,
                    _Factory__defaults=defaults,
                    _Factory__all_fields=all_fields,
                    _Factory__last_field=last_field,
                    _Factory__full_required=full_required,
                    _Factory__sealer=sealer,
                )
            )
        else:
            for pos, names in enumerate(zip(*[
                k.__all_fields
                for k in bases
                if isinstance(k, _Factory)
            ])):
                if names:
                    if len(set(names)) != 1:
                        raise TypeError("Field layout conflict: fields in position {0} have different names: {1}".format(
                            pos,
                            ', '.join(repr(name) for name in names)
                        ))

            return type(name, tuple(
                    ~k if isinstance(k, _Factory) else k for k in bases
            ), {} if namespace is None else namespace)

    def __init__(cls, *args, **kwargs):
        pass

    def __call__(cls, *args, **kwargs):
        return (~cls)(*args, **kwargs)

    def __invert__(cls):
        if cls.__concrete is None:
            if not cls.__all_fields:
                raise TypeError("You're trying to use an empty Fields factory !")
            if cls.__defaults and cls.__last_field is not None:
                raise TypeError("Can't add required fields after fields with defaults.")

            cls.__concrete = cls.__sealer(cls.__all_fields, cls.__defaults)
        return cls.__concrete


class Namespace(object):
    """
    A backport of Python 3.3's ``types.SimpleNamespace``.
    """
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def __repr__(self):
        keys = sorted(self.__dict__)
        items = ("{0}={1!r}".format(k, self.__dict__[k]) for k in keys)
        return "{0}({1})".format(type(self).__name__, ", ".join(items))

    def __eq__(self, other):
        return self.__dict__ == other.__dict__


def factory(sealer, **sealer_options):
    """
    Create a factory that will produce a class using the given ``sealer``.

    Args:
        sealer (func): A function that takes ``fields, defaults`` as arguments, where:

            * fields (list): A list with all the field names in the declared order.
            * defaults (dict): A dict with all the defaults.
        sealer_options: Optional keyword arguments passed to ``sealer``.
    Return:
        A class on which you can do `.field1.field2.field3...`. When it's subclassed it "seals", and whatever the
        ``sealer`` returned for the given fields is used as the baseclass.

        Example:

        .. sourcecode:: pycon


            >>> def sealer(fields, defaults):
            ...     print("Creating class with:")
            ...     print("  fields = {0}".format(fields))
            ...     print("  defaults = {0}".format(defaults))
            ...     return object
            ...
            >>> Fields = factory(sealer)
            >>> class Foo(Fields.foo.bar.lorem[1].ipsum[2]):
            ...     pass
            ...
            Creating class with:
              fields = ['foo', 'bar', 'lorem', 'ipsum']
              defaults = OrderedDict([('lorem', 1), ('ipsum', 2)])
            >>> Foo
            <class '...Foo'>
            >>> Foo.__bases__
            (<... 'object'>,)
    """
    return _Factory(sealer=_SealerWrapper(sealer, **sealer_options))

Fields = _Factory()
ConvertibleFields = factory(class_sealer, convertible=True)
SlotsFields = factory(slots_class_sealer)
BareFields = factory(class_sealer, comparable=False, printable=False)
InheritableFields = factory(class_sealer, base=object, pass_kwargs=True)

Tuple = factory(tuple_sealer)

PrintableMixin = factory(class_sealer, initializer=False, base=object, comparable=False)
ComparableMixin = factory(class_sealer, initializer=False, base=object, printable=False)
ConvertibleMixin = factory(
    class_sealer, initializer=False, base=object, printable=False, comparable=False, convertible=True
)
