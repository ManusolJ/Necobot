export interface WikidataEntitiesResponse {
  entities?: Record<
    string,
    {
      sitelinks?: Record<
        string,
        {
          title?: string;
        }
      >;
    }
  >;
}
