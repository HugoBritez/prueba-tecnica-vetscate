export class ReservationResponseDto {
  id: number;
  startTime: Date;
  endTime: Date;
  room: {
    id: number;
    name: string;
    capacity: number;
  };
  user: {
    id: number;
    name: string;
    email: string;
  };

  constructor(partial: Partial<ReservationResponseDto>) {
    Object.assign(this, partial);
  }
}
