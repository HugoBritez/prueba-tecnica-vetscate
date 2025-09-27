export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  role: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
