import { TypedEmitter } from '../typed-emitter';
import Util from '../player-util';

export class BaseClient<P extends any, TE> extends TypedEmitter<TE> {
  protected title = 'BaseClient';
  protected params: any;

  protected constructor(query: any) {
    super();
    this.params = this.parseParameters(query) as any;
  }

  protected parseParameters(query: any): any {
    return {
      action: Util.parseStringEnv(query?.action),
      useProxy: Util.parseBooleanEnv(query?.useProxy),
      secure: Util.parseBooleanEnv(query?.secure),
      hostname: Util.parseStringEnv(query?.hostname),
      port: Util.parseIntEnv(query?.port),
    };
  }

  public setTitle(text = this.title): void {
    let titleTag: HTMLTitleElement | null =
      document.querySelector('head > title');
    if (!titleTag) {
      titleTag = document.createElement('title');
    }
    titleTag.innerText = text;
  }

  public setBodyClass(text: string): void {
    document.body.className = text;
  }
}
