import {ApiProperty,PartialType} from '@nestjs/swagger';
import {Transform,Type} from 'class-transformer';
import {IsIn,IsInt,IsOptional,IsString,IsUUID,Length,Max,Min,ValidateIf} from 'class-validator';
export const TICKET_CATEGORIES=['SIP_TRUNKING','BILLING','NUMBER_PORTING','DID_PROVISIONING','CALL_QUALITY','TECHNICAL_SUPPORT','ACCOUNT_VERIFICATION','GENERAL'] as const;
export const TICKET_PRIORITIES=['LOW','NORMAL','HIGH','URGENT'] as const;
export const TICKET_STATUSES=['OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED'] as const;
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export class TicketQueryDto {
 @ApiProperty() @IsOptional() @Transform(trim) @IsString() @Length(0,100) search?:string;
 @ApiProperty() @IsOptional() @IsIn(TICKET_STATUSES) status?:string;
 @ApiProperty() @IsOptional() @IsIn(TICKET_PRIORITIES) priority?:string;
 @ApiProperty() @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(10000) page:number=1;
}
export class CreateTicketDto {
 @ApiProperty() @Transform(trim) @IsString() @Length(5,140) subject!:string;
 @ApiProperty() @Transform(trim) @IsString() @Length(10,10000) description!:string;
 @ApiProperty() @IsIn(TICKET_CATEGORIES) category!:string;
 @ApiProperty() @IsIn(TICKET_PRIORITIES) priority!:string;
}
export class TicketRevisionDto {@ApiProperty() @IsInt() @Min(0) expectedVersion!:number;}
export class ReplyDto extends TicketRevisionDto {@ApiProperty() @Transform(trim) @IsString() @Length(1,10000) body!:string;}
export class CustomerTicketStateDto extends TicketRevisionDto {@ApiProperty() @IsIn(['OPEN','CLOSED']) status!:'OPEN'|'CLOSED';}
export class AdminTicketUpdateDto extends TicketRevisionDto {
 @ApiProperty() @ValidateIf((_o,value)=>value!==undefined) @IsIn(TICKET_STATUSES) status?:string;
 @ApiProperty() @ValidateIf((_o,value)=>value!==undefined) @IsIn(TICKET_PRIORITIES) priority?:string;
 @ApiProperty() @IsOptional() @IsUUID() assignedTo?:string|null;
}
