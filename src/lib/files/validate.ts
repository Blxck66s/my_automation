export function makeFileValidator(accept: string[]) {
  const lowered = accept.map((a) => a.toLowerCase());
  return (file: File) => {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return lowered.some((a) => name.endsWith(a) || type === a);
  };
}
