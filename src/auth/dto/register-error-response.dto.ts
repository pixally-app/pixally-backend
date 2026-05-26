import { ApiProperty } from '@nestjs/swagger';

export class ConflictResponseDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({ example: 'Email already registered', description: 'Pode ser "Email already registered" ou "Document already registered"' })
  message: string;

  @ApiProperty({ example: 'Conflict' })
  error: string;
}

export class BadRequestResponseDto {
  @ApiProperty({
    example: [
      'email must be an email',
      'password must be longer than or equal to 6 characters',
      'username should not be empty',
      'document should not be empty',
      'phone should not be empty',
    ],
  })
  message: string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: 400 })
  statusCode: number;
}
