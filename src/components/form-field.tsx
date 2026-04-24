export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="label mb-2">
        {label}
        {required ? " ·" : ""}
      </div>
      {children}
    </label>
  );
}
