"""Manual Wolf smoke-test: open this file and start a Wolf session.

The file intentionally combines common Python constructs with Wolf's ``#?``
comment macros. It is a hands-on coverage script, not yet an automated test.
"""

from collections import Counter, defaultdict, namedtuple
from datetime import date, timedelta
import json
from pathlib import Path
import tempfile


# --- Scalars, operators, strings, and Unicode ---------------------------------

integer_value = 42  #?
negative_value = -integer_value  #?
float_value = 3.14159  #?
bool_value = integer_value > 10  #?
none_value = None  #?

sum_value = integer_value + 8  #?
sum_value += 2  #?
sum_value -= 1  #?
sum_value *= 2  #?

message = "Wolf says hello"  #?
unicode_message = "Café, 雪, and 🐺"  #?
formatted_message = f"{message}: {sum_value:,}"  #?
string_parts = message.split()  #?
joined_message = " / ".join(string_parts)  #?

print("Plain print output is captured too.")
print("Unicode print: café 雪 🐺")
print(f"Formatted print: {formatted_message}")


# --- Containers, indexing, slicing, and comprehensions -----------------------

numbers = [1, 2, 3, 4, 5]  #?
coordinates = (10, 20, 30)  #?
unique_numbers = {1, 2, 2, 3, 3, 3}  #?
profile = {
    "name": "Ada",
    "language": "Python",
    "active": True,
}  #?

first_number = numbers[0]  #?
last_two = numbers[-2:]  #?
reversed_numbers = numbers[::-1]  #?
profile_name = profile.get("name")  #?

squares = [number * number for number in numbers]  #?
even_squares = [number * number for number in numbers if number % 2 == 0]  #?
square_lookup = {number: number * number for number in numbers}  #?
number_labels = {number: "even" if number % 2 == 0 else "odd" for number in numbers}  #?
flattened = [item for row in [[1, 2], [3, 4], [5]] for item in row]  #?

# The following macros exercise defensive evaluation around mutating methods.
mutable_values = ["alpha", "beta", "gamma"]
mutable_values.pop()  #?
mutable_values.append("delta")  #?
mutable_values  #?


# --- Iteration, loops, and accumulation --------------------------------------

running_total = 0
for number in numbers:
    running_total += number  #?
    last_seen = number  #?

loop_summary = (running_total, last_seen)  #?

countdown = 3
while countdown > 0:
    countdown -= 1  #?

countdown_finished = countdown == 0  #?


# --- Functions, defaults, keyword arguments, recursion, and closures ----------

def describe_person(name, role="developer", *, years=1):
    """Return a formatted description using positional and keyword-only args."""
    description = f"{name} is a {role} with {years} year(s) of experience"
    return description


def factorial(value):
    """Small recursive function, safe to inspect in a live session."""
    if value <= 1:
        return 1
    return value * factorial(value - 1)


def make_multiplier(factor):
    """Return a closure that captures a local value."""
    def multiply(value):
        return factor * value
    return multiply


person_description = describe_person("Grace", years=7)  #?
factorial_result = factorial(6)  #?
double = make_multiplier(2)  #?
closure_result = double(21)  #?
lambda_result = (lambda value: value ** 2)(9)  #?


# --- Classes, methods, properties, and object representations ----------------

class Rectangle:
    """Tiny class for checking object and method evaluation."""

    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def area(self):
        return self.width * self.height

    def scale(self, factor):
        return Rectangle(self.width * factor, self.height * factor)

    def __repr__(self):
        return f"Rectangle(width={self.width}, height={self.height})"


rectangle = Rectangle(4, 5)  #?
rectangle_area = rectangle.area  #?
large_rectangle = rectangle.scale(3)  #?
large_rectangle_area = large_rectangle.area  #?
rectangle_description = repr(rectangle)  #?

Point = namedtuple("Point", ["x", "y"])
point = Point(3, 4)  #?


# --- Exceptions and branching ------------------------------------------------

try:
    risky_result = 10 / 2
except ZeroDivisionError:
    risky_result = "division failed"

try:
    1 / 0
except ZeroDivisionError as error:
    caught_error = str(error)  #?

if bool_value:
    branch_result = "condition was true"  #?
else:
    branch_result = "condition was false"  #?


# --- Standard-library objects and serialization ------------------------------

word_counts = Counter(["wolf", "fox", "wolf", "dog", "wolf"])  #?
word_counts.most_common(2)  #?

buckets = defaultdict(list)
for key, value in (("a", 1), ("b", 2), ("a", 3)):
    buckets[key].append(value)
defaultdict_result = dict(buckets)  #?

json_text = json.dumps(profile, sort_keys=True)  #?
json_roundtrip = json.loads(json_text)  #?
today = date.today()
tomorrow = today + timedelta(days=1)
date_result = tomorrow.isoformat()  #?

path_result = Path("scripts") / "tests" / "kitchensink.py"  #?
path_suffix = path_result.suffix  #?

# File operations use a temporary directory and leave no project files behind.
with tempfile.TemporaryDirectory(prefix="wolf-kitchensink-") as temporary_directory:
    temporary_path = Path(temporary_directory) / "sample.json"
    temporary_path.write_text(json_text, encoding="utf-8")
    temporary_file_contents = temporary_path.read_text(encoding="utf-8")  #?

temporary_json = json.loads(temporary_file_contents)  #?


# --- Final values: convenient things to inspect after the run -----------------

final_summary = {
    "total": running_total,
    "factorial_6": factorial_result,
    "rectangle_area": rectangle_area,
    "large_rectangle_area": large_rectangle_area,
    "unique_count": len(unique_numbers),
    "json_name": temporary_json["name"],
    "caught_error": caught_error,
    "unicode": unicode_message,
}  #?

print("Kitchen-sink run completed.")
print(json.dumps(final_summary, ensure_ascii=False, indent=2))
