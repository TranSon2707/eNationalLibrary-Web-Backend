import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reader } from './reader.entity';
import { ReaderService } from './reader.service';
import { ReaderController } from './reader.controller';
import { UserModule } from '../user/user.module';
import { ReadingCardModule } from '../reading-card/reading-card.module';
import { BorrowRecordModule } from '../borrow-record/borrow-record.module';
import { ReturnRecordModule } from '../return-record/return-record.module';
import { BookModule } from '../book/book.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Reader]),
        forwardRef(() => ReadingCardModule),
        forwardRef(() => BorrowRecordModule),
        forwardRef(() => ReturnRecordModule),
        BookModule,
        UserModule,
    ],
    controllers: [ReaderController],
    providers: [ReaderService],
    exports: [ReaderService],
})
export class ReaderModule {}