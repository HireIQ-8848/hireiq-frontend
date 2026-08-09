export default function BrandLogo({ style, className = "" }) {
  return <span className={`brand-mark hireiq-brand-logo ${className}`.trim()} style={style} aria-hidden="true"><img src="/brand/hireiq-logo.png" alt="" /></span>;
}
