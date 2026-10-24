// The rules the server enforces on a new password (ChangePasswordInput: 8..200 characters), stated beside the
// field and checked before the request so the person is told what is wrong rather than getting a bare 400.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters. Use something you do not use anywhere else.`;

export function newPasswordProblem(newPassword: string, confirm: string, currentPassword = ""): string | null {
  if (newPassword.length < PASSWORD_MIN_LENGTH) return `The new password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (newPassword.length > PASSWORD_MAX_LENGTH) return `The new password can be at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (currentPassword !== "" && newPassword === currentPassword) return "The new password must differ from the current one.";
  if (newPassword !== confirm) return "The two new passwords do not match.";
  return null;
}
