import { StubScreen } from '../ui/StubScreen';
import { translate, useLocale } from '../locales/i18n';
export function HotkeyConfigScreen() {
  const locale = useLocale();
  return <StubScreen title={translate('ui.settings.title', locale)} />;
}
