export class RoomResponseDto {
  id: number;
  name: string;
  capacity: number;

  constructor(partial: Partial<RoomResponseDto>) {
    Object.assign(this, partial);
  }
}
