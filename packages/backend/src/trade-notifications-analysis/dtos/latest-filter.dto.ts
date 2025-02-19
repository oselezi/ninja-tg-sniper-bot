export class LatestMetaFilterDTO {
  limit: number;
  offset: number;
  filter?: 'all' | 'matched';
}
