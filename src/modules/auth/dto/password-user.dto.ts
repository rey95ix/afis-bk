import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class PasswordUserDto {
 
    @ApiProperty({})
    @IsString() 
    curren_password: string;
 
    @ApiProperty({})
    @IsString()
    @MinLength(8,{message:'La nueva contraseña debe tener almenos 8 caracteres'})
    new_password: string;

}
