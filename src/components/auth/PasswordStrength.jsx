import { Check, X } from "lucide-react";
import { checkPassword } from "../../lib/password.js";

const SCORE_COLOR = ["#e0432b", "#e0432b", "#f2a71b", "#f2a71b", "#17a768", "#17a768"];

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const { rules, score, label } = checkPassword(password);

  return (
    <div className="password-strength">
      <div className="strength-bars">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="strength-bar"
            style={{ background: i < score ? SCORE_COLOR[score] : "var(--border)" }}
          />
        ))}
        <span className="strength-label" style={{ color: SCORE_COLOR[score] }}>
          {label}
        </span>
      </div>
      <ul className="rule-list">
        {rules.map((rule) => (
          <li key={rule.key} className={rule.passed ? "passed" : ""}>
            {rule.passed ? <Check size={12} /> : <X size={12} />}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}