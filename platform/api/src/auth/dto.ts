import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @Length(1,128) password!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{6}$/) code?: string;
}
export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({minLength:12}) @IsString() @Length(12,128) password!: string;
  @ApiProperty() @IsString() @Length(12,128) confirmPassword!: string;
  @ApiProperty() @IsString() @Length(2,100) fullName!: string;
  @ApiProperty() @IsString() @Length(2,150) businessName!: string;
  @ApiProperty() @IsString() @Length(2,60) country!: string;
  @ApiProperty() @Matches(/^\+?[\d ()-]{7,25}$/) phone!: string;
  @ApiProperty() @IsString() @Length(5,400) address!: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({require_protocol:true}) website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,100) registrationNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,80) taxId?: string;
  @ApiProperty() @IsBoolean() acceptTerms!: boolean;
}
export class TokenDto { @ApiProperty() @IsString() @Length(32,128) token!: string; }
export class ResetRequestDto { @ApiProperty() @IsEmail() email!: string; }
export class ResetDto extends TokenDto { @ApiProperty() @IsString() @Length(12,128) password!: string; }
export class TotpDto { @ApiProperty() @Matches(/^\d{6}$/) code!: string; }
export class StatusDto {
  @ApiProperty({enum:['UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED']}) @IsIn(['UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED']) status!: 'UNDER_REVIEW'|'APPROVED'|'REJECTED'|'SUSPENDED';
  @ApiProperty() @IsString() @Length(5,500) reason!: string;
}
export class ContactDto {
  @ApiProperty() @IsString() @Length(2,100) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @Length(10,2000) message!: string;
}
