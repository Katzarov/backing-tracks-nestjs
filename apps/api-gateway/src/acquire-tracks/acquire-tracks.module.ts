import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AcquireTracksService } from './acquire-tracks.service';
import { AcquireTracksController } from './acquire-tracks.controller';
import { TracksModule } from '../tracks/tracks.module';
import { SpotifyService } from './spotify.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TracksModule, UserModule],
  controllers: [AcquireTracksController],
  providers: [
    AcquireTracksService,
    SpotifyService,
    {
      provide: 'YOUTUBE_DOWNLOADER_SERVICE',
      useFactory: (configService: ConfigService) => {
        const host = configService.getOrThrow<string>('youtubeDownloader.host');
        const port = configService.getOrThrow<number>('youtubeDownloader.port');

        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host, port },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'FILE_CONVERTER_SERVICE',
      useFactory: (configService: ConfigService) => {
        const host = configService.getOrThrow<string>('fileConverter.host');
        const port = configService.getOrThrow<number>('fileConverter.port');

        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host, port },
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AcquireTracksModule {}
