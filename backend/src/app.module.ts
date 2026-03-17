import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DtqueueModule } from './dtqueue/dtqueue.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DtqueueModule, ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
