import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

type ControlCopy = { description?: ReactNode; error?: ReactNode; label: ReactNode };

/** 统一 label、辅助说明与错误关联，避免输入框只有视觉标签而缺少可访问语义。 */
export const UiTextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ControlCopy>(
  ({ className, description, error, id, label, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const hintId = `${controlId}-hint`;
    return <label className={["ui-field", className].filter(Boolean).join(" ")} htmlFor={controlId}>
      <span className="ui-field__label">{label}</span>
      <input {...props} aria-describedby={description || error ? hintId : undefined} aria-invalid={Boolean(error) || undefined} id={controlId} ref={ref} />
      {description || error ? <small className={error ? "ui-field__message is-error" : "ui-field__message"} id={hintId}>{error ?? description}</small> : null}
    </label>;
  },
);

UiTextField.displayName = "UiTextField";

export const UiSelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & ControlCopy>(
  ({ children, className, description, error, id, label, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const hintId = `${controlId}-hint`;
    return <label className={["ui-field", className].filter(Boolean).join(" ")} htmlFor={controlId}>
      <span className="ui-field__label">{label}</span>
      <select {...props} aria-describedby={description || error ? hintId : undefined} aria-invalid={Boolean(error) || undefined} id={controlId} ref={ref}>{children}</select>
      {description || error ? <small className={error ? "ui-field__message is-error" : "ui-field__message"} id={hintId}>{error ?? description}</small> : null}
    </label>;
  },
);

UiSelectField.displayName = "UiSelectField";
