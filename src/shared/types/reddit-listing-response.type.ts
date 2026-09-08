export interface RedditListingResponse {
  data?: {
    children?: {
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        stickied?: boolean;
        over_18?: boolean;
      };
    }[];
  };
}
