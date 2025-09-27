import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isAfterStartTime', async: false })
export class IsAfterStartTime implements ValidatorConstraintInterface {
  validate(endTime: string, args: ValidationArguments): boolean {
    const dto = args.object as any;
    const startTime = dto.startTime;

    if (!startTime || !endTime) {
      return false;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    return endDate > startDate;
  }

  defaultMessage(): string {
    return 'End time must be after start time';
  }
}
