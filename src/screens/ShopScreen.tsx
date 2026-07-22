import { StubScreen } from '../ui/StubScreen';
import { translate, useLocale } from '../locales/i18n';
export function ShopScreen() {
  const locale = useLocale();
  return <StubScreen title={translate('ui.shop.title', locale)} />;
}
