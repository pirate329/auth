import {
  IsEmail,
  isEmail,
  IsString,
  Max,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

export class AuthDto {
  @IsString()
  readonly firstName: string;
  @IsString()
  readonly lastName: string;
  @IsEmail()
  readonly email: string;
  @MinLength(8)
  @MaxLength(12)
  @IsNotEmpty()
  readonly password: string;
}

export class LoginDto {
  @IsEmail()
  readonly email: string;

  // @IsString()
  // @IsNotEmpty()
  // readonly deviceId: string;

  @IsString()
  @IsNotEmpty()
  readonly password: string;
}
