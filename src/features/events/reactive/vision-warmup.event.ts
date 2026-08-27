import { warmUpImageClassifier } from "@infrastructure/ai/clip.client.js";

import { Events, Listener } from "@sapphire/framework";

export class VisionWarmupListener extends Listener<typeof Events.ClientReady> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ClientReady, once: true });
  }

  public override async run(): Promise<void> {
    await warmUpImageClassifier();
  }
}
