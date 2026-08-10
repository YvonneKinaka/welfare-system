import { InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className = "", id, ...props }, ref) => (
  <div className="w-full">
    {label && (
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">
        {label}
      </label>
    )}
    <input
      ref={ref}
      id={id}
      className={`w-full rounded-full border ${
        error ? "border-danger-text" : "border-line"
      } bg-white px-5 py-3 text-base text-ink placeholder:text-body/60 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
    {error && <p className="mt-1 text-sm text-danger-text">{error}</p>}
  </div>
));
Input.displayName = "Input";
export default Input;
