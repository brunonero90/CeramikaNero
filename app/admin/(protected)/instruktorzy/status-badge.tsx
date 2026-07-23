export function InstructorStatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
        Aktywny
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      Nieaktywny
    </span>
  );
}
