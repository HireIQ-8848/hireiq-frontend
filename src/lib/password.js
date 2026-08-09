// Password validation rules and strength scoring.
// Adjust MIN_LENGTH / rules here to match your backend's actual policy.

export const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { key: "lower", label: "One lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { key: "number", label: "One number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { key: "special", label: "One special character (!@#$…)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

// Small deny-list of commonly leaked/guessed passwords.
// Swap in a real breached-password check server-side for production
// (e.g. the k-anonymity HaveIBeenPwned range API).
const COMMON_PASSWORDS = new Set([
  "password", "12345678", "123456789", "qwerty123", "password1",
  "letmein123", "admin123", "welcome123", "iloveyou1", "abc123456",
]);

export function checkPassword(password = "") {
  const results = PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) }));
  const passedCount = results.filter((r) => r.passed).length;
  const isCommon = COMMON_PASSWORDS.has(password.toLowerCase());

  let score = passedCount; // 0-5
  if (isCommon) score = Math.min(score, 1);

  let label = "Very weak";
  if (score >= 5) label = "Strong";
  else if (score >= 4) label = "Good";
  else if (score >= 3) label = "Fair";
  else if (score >= 2) label = "Weak";

  return {
    rules: results,
    score,
    label,
    isCommon,
    isValid: passedCount === PASSWORD_RULES.length && !isCommon,
  };
}