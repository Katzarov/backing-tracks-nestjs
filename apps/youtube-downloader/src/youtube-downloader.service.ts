import { Injectable } from '@nestjs/common';
import { pipeline } from 'node:stream/promises';
import * as ytdl from 'ytdl-core';
import { formatBytes } from './utils';
import { LocalDiskFileStorageService } from '@app/local-disk-file-storage';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class YoutubeDownloaderService {
  private downloadsFolderName: string;

  // constructor(@Inject('YTDL_LIB') private ytdl) {}
  constructor(
    private localDiskStorageService: LocalDiskFileStorageService,
    private configService: ConfigService,
  ) {
    this.downloadsFolderName = this.configService.getOrThrow<string>(
      'storage.localDisk.downloadsFolder',
    );
  }

  async getYouTubeVideoInfo(url: string) {
    const info = await ytdl.getInfo(url);

    const { title, author, lengthSeconds, thumbnails } = info.videoDetails;
    const { name } = author;
    const thumbnailUrl = thumbnails[0].url;

    return { title, channel: name, length: lengthSeconds, thumbnailUrl };
  }

  async downloadYouTubeVideo(url: string, name: string) {
    const info = await ytdl.getInfo(url);
    const formats = ytdl.filterFormats(info.formats, 'audioonly');
    const choosenFormat = ytdl.chooseFormat(formats, {
      quality: 'highestaudio',
    });

    const videoStream = ytdl(url, { format: choosenFormat });
    // videoStream.on('info', (info) => {
    //   console.log(info);
    // });

    videoStream.on('progress', (e) => {
      console.log(formatBytes(e));
    });

    // videoStream.on('error', () => {
    //   console.log('error');
    // });

    // videoStream.on('end', () => {
    //   console.log('end ');
    // });

    const writableFileStream = this.localDiskStorageService.getWritableStream(
      this.downloadsFolderName,
      name,
      'mp4',
    );

    await pipeline(videoStream, writableFileStream);
    console.log('downloaded');

    return name;
  }
}
