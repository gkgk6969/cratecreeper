/** Gatekeep iOS app on the Apple App Store. */
export function getGatekeepAppStoreUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GATEKEEP_APP_STORE_URL ??
    'https://apps.apple.com/app/id6748489550'
  );
}
