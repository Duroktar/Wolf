
export function clamp(blop: number, bloop: number, bleep: number): number {
  return bleep > bloop ? bloop : bleep < blop ? blop : bleep;
}

export function indexOrLast(string: string, target: string): number {
  const idx = string.indexOf(target);
  return idx === -1 ? -1 : idx + target.length;
}

export function stringEscape(text: string | number): string {
  // From: `js-string-escape` https://github.com/joliss/js-string-escape
  // License: MIT ~ https://github.com/joliss/js-string-escape/blob/master/LICENSE

  return ("" + text).replace(/[\\\n\r\u2028\u2029]/g, (char: string) => {
    // Escape all characters not included in SingleStringCharacters and
    // DoubleStringCharacters on
    // http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
    switch (char) {
      case "\\":
        return "\\" + char;
      // Four possible LineTerminator characters need to be escaped:
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return char;
    }
  });
}
