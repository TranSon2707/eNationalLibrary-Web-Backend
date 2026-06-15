import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Reader } from './reader.entity';
import { ReaderPublicDto } from './dto/reader-public.dto';
import { CreateReaderDto } from './dto/create-reader.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateReaderDto } from './dto/update-reader.dto';
import { ReaderMapper } from './reader.mapper';
import { UserService } from '../user/user.service';
import { ReadingCard } from '../reading-card/reading-card.entity';
import { BorrowRecord } from '../borrow-record/borrow-record.entity';
import { ReturnRecord } from '../return-record/return-record.entity';
import { Book } from '../book/book.entity';
import { ReadingCardService } from '../reading-card/reading-card.service';
import { BorrowRecordService } from '../borrow-record/borrow-record.service';
import { ReturnRecordService } from '../return-record/return-record.service';
import { BookService } from '../book/book.service';

@Injectable()
export class ReaderService {
    constructor(
    @InjectRepository(Reader)
    private readonly readerRepo: Repository<Reader>,

    @Inject(forwardRef(() => ReadingCardService))
    private readonly readingCardService: ReadingCardService,

    @Inject(forwardRef(() => BorrowRecordService))
    private readonly borrowRecordService: BorrowRecordService,

    @Inject(forwardRef(() => ReturnRecordService))
    private readonly returnRecordService: ReturnRecordService,

    @Inject(forwardRef(() => BookService))
    private readonly bookService: BookService,

    private readonly userService: UserService,
    ) {}

    async create(dto: CreateReaderDto): Promise<Reader> {
        const reader = await ReaderMapper.createFromDto(dto);

        if(dto.user) {
            const user = await this.userService.create(dto.user);
            reader.user = user;
            reader.userId = user.userId;
        }

        const saved = await this.save(reader);

        return saved;
    }

    async findOneById(userId: string | { userId: string }, relations: string[]): Promise<Reader | null> {
        const options = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
        return this.findOneByOptions(options, relations);
    }

    async findOneByOptions(options: FindOptionsWhere<Reader>, relations: string[]): Promise<Reader | null> {
    const reader = await this.readerRepo.findOne({ 
        where: options, 
        relations: relations,
    });
    if (!reader) return null;
    
    // If 'user' is in relations but user is null, try loading it explicitly
    if (relations.includes('user') && !reader.user) {
        const readerWithUser = await this.readerRepo.findOne({
            where: options,
            relations: ['user'],
        });
        if (readerWithUser?.user) reader.user = readerWithUser.user;
    }
    
    return reader;
}

    async findManyByOptions(options: FindOptionsWhere<Reader>, relations: string[]): Promise<Reader[]> {
        const readers = await this.readerRepo.find({ where: options, relations: relations });
        return readers;
    }

    async findAll(relations: string[]): Promise<Reader[]> {
        return this.findManyByOptions({}, relations);
    }

    async updateOneById(userId: string | { userId: string }, dto: UpdateReaderDto): Promise<boolean> {
        const options = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
        return this.updateOneByOptions(options, dto);
    }

    async updateOneByOptions(options: FindOptionsWhere<Reader>, dto: UpdateReaderDto): Promise<boolean> {
        const reader = await this.findOneByOptions(options, []);
        if(!reader) return false;

        await ReaderMapper.updateFromDto(reader, dto);

        if(dto.user) {
            await this.userService.updateOneById(reader.userId, dto.user);
            
            reader.user = await this.userService.findOneById(reader.userId, []);
        }

        const saved = await this.save(reader);

        return true;
    }

    async updateManyByOptions(options: FindOptionsWhere<Reader>, dto: UpdateReaderDto): Promise<boolean> {
        const readers = await this.findManyByOptions(options, []);

        for (const reader of readers) {
            await ReaderMapper.updateFromDto(reader, dto);

            if(dto.user) {
                await this.userService.updateOneById(reader.userId, dto.user);

                reader.user = await this.userService.findOneById(reader.userId, []);
            }
            
            await this.save(reader);
        }

        return true;
    }

    async removeOneById(userId: string | { userId: string }): Promise<boolean> {
        const options = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
        return this.removeOneByOptions(options);
    }

    async removeOneByOptions(options: FindOptionsWhere<Reader>): Promise<boolean> {
        // Load the reader together with everything that references it, so foreign-key
        // constraints don't block the delete. NOTE: the relation is "user" (singular).
        const reader = await this.findOneByOptions(
            options,
            ['user', 'borrowRecords', 'readingCards', 'reviews', 'waitingBooks'],
        );
        if (!reader) return false;

        const manager = this.readerRepo.manager;

        // Detach many-to-many waiting books (clears the join-table rows).
        if (reader.waitingBooks && reader.waitingBooks.length) {
            reader.waitingBooks = [];
            await this.save(reader);
        }
        // Delete dependent records that hold a FK to this reader.
        if (reader.borrowRecords && reader.borrowRecords.length) {
            await manager.remove(reader.borrowRecords);
        }
        if (reader.readingCards && reader.readingCards.length) {
            await manager.remove(reader.readingCards);
        }
        if (reader.reviews && reader.reviews.length) {
            await manager.remove(reader.reviews);
        }

        await this.remove(reader);
        if (reader.user) {
            await this.userService.remove(reader.user);
        }
        return true;
    }

    async removeManyByOptions(options: FindOptionsWhere<Reader>): Promise<boolean> {
        const readers = await this.findManyByOptions(options, ['user']);
        await this.removeMany(readers);
        await this.userService.removeMany(readers.map(r => r.user).filter(e => !!e));
        return true;
    }

    async save(reader: Reader): Promise<Reader> {
        return await this.readerRepo.save(reader);
    }

    async remove(reader: Reader): Promise<Reader> {
        return await this.readerRepo.remove(reader);
    }

    async removeMany(readers: Reader[]): Promise<Reader[]> {
        return await this.readerRepo.remove(readers);
    }

    // async addReaderReadingCard(userId: string | { userId: string }, readingCardId: string | { readingCardId: string }): Promise<Reader | null> {
    //     const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
    //     const readingCardOptions = typeof readingCardId === "string" ? { readingCardId: readingCardId } : { readingCardId: readingCardId.readingCardId };

    //     const reader = await this.findOneByOptions(readerOptions, []);
    //     if (!reader) return null;

    //     const readingCard = await this.readingCardService.findOneByOptions(readingCardOptions, ['readers']);
    //     if(!readingCard) return null;

    //     // if(readingCard.reader && readingCard.reader.userId !== reader.userId) return null;
        
    //     // gán từ phía owning side
    //     readingCard.reader = reader;
    //     await this.readingCardService.save(readingCard);

    //     return await this.findOneByOptions(readerOptions, ['reading-cards']);
    // }

    // async removeReaderReadingCard(userId: string | { userId: string }, readingCardId: string | { readingCardId: string }): Promise<Reader | null> {
    //     const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
    //     const readingCardOptions = typeof readingCardId === "string" ? { readingCardId: readingCardId } : { readingCardId: readingCardId.readingCardId };

    //     const readingCard = await this.readingCardService.findOneByOptions(readingCardOptions, ['readers'] );
    //     if(!readingCard) return null;

    //     if(readingCard.reader && readingCard.reader.userId !== readerOptions.userId) return null;

    //     // xoá quan hệ bằng cách set null hoặc xoá record
    //     await this.readingCardService.remove(readingCard);

    //     return await this.findOneByOptions(readerOptions, ['reading-cards']);
    // }

    // async clearReaderReadingCards(userId: string | { userId: string }): Promise<Reader | null> {
    //     const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };

    //     const reader = await this.findOneByOptions(readerOptions, ['reading-cards']);
    //     if (!reader) return null;

    //     await this.readingCardService.removeMany(reader.readingCards);

    //     return await this.findOneByOptions(readerOptions, ['reading-cards']);
    // }

    // async addReaderBorrowRecord(userId: string | { userId: string }, borrowRecordId: string | { borrowRecordId: string }): Promise<Reader | null> {
    //     const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
    //     const borrowRecordOptions = typeof borrowRecordId === "string" ? { borrowRecordId: borrowRecordId } : { borrowRecordId: borrowRecordId.borrowRecordId };

    //     const reader = await this.findOneByOptions(readerOptions, []);
    //     if (!reader) return null;

    //     const borrowRecord = await this.borrowRecordService.findOneByOptions(borrowRecordOptions, ['readers']);
    //     if(!borrowRecord) return null;

    //     // if(borrowRecord.reader && borrowRecord.reader.userId !== reader.userId) return null;

    //     // gán từ phía owning side
    //     borrowRecord.reader = reader;
    //     await this.borrowRecordService.save(borrowRecord);

    //     return await this.findOneByOptions(readerOptions, ['borrow-records']);
    // }

    // async removeReaderBorrowRecord(userId: string | { userId: string }, borrowRecordId: string | { borrowRecordId: string }): Promise<Reader | null> {
    //     const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
    //     const borrowRecordOptions = typeof borrowRecordId === "string" ? { borrowRecordId: borrowRecordId } : { borrowRecordId: borrowRecordId.borrowRecordId };

    //     const borrowRecord = await this.borrowRecordService.findOneByOptions(borrowRecordOptions, ['readers']);
    //     if(!borrowRecord) return null;

    //     if(borrowRecord.reader && borrowRecord.reader.userId !== readerOptions.userId) return null;

    //     // xoá quan hệ bằng cách set null hoặc xoá record
    //     await this.borrowRecordService.remove(borrowRecord);

    //     return await this.findOneByOptions(readerOptions, ['borrow-records']);
    // }

    // async clearReaderBorrowRecords(userId: string | { userId: string }): Promise<Reader | null> {
    //     const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };

    //     const reader = await this.findOneByOptions(readerOptions, ['borrow-records']);
    //     if (!reader) return null;

    //     await this.borrowRecordService.removeMany(reader.borrowRecords);

    //     return await this.findOneByOptions(readerOptions, ['borrow-records']);
    // }

    async addWaitingBook(userId: string | { userId: string }, bookId: string | { bookId: string }): Promise<Reader | null> {
        const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
        const bookOptions = typeof bookId === "string" ? { bookId: bookId } : { bookId: bookId.bookId };

        const reader = await this.findOneByOptions(readerOptions, ['books']);
        if (!reader) return null;

        const book = await this.bookService.findOneByOptions(bookOptions, []);
        if(!book) return null;

        if(!(reader.waitingBooks.find(b => b.bookId === book.bookId)))
        {
            reader.waitingBooks.push(book);
            const saved = await this.save(reader);
        }

        return await this.findOneByOptions(readerOptions, ['books']);
    }

    async removeWaitingBook(userId: string | { userId: string }, bookId: string | { bookId: string }): Promise<Reader | null> {
        const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };
        const bookOptions = typeof bookId === "string" ? { bookId: bookId } : { bookId: bookId.bookId };

        const reader = await this.findOneByOptions(readerOptions, ['books']);
        if (!reader) return null;

        const indexToRemove = reader.waitingBooks.findIndex(item => item.bookId === bookOptions.bookId);
        if (indexToRemove !== -1) {
            reader.waitingBooks.splice(indexToRemove, 1);
        }

        const saved = await this.save(reader);

        return await this.findOneByOptions(readerOptions, ['books']);
    }

    async clearWaitingBooks(userId: string | { userId: string }): Promise<Reader | null> {
        const readerOptions = typeof userId === "string" ? { userId: userId } : { userId: userId.userId };

        const reader = await this.findOneByOptions(readerOptions, []);
        if (!reader) return null;

        reader.waitingBooks = [];

        const saved = await this.save(reader);

        return await this.findOneByOptions(readerOptions, ['books']);
    }
}