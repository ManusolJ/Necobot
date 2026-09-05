export interface RedditListingResponse {
  data?: {
    children?: {
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        permalink?: string;
        stickied?: boolean;
      };
    }[];
  };
}
