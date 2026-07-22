import { StubScreen } from '../ui/StubScreen';
import { translate, useLocale } from '../locales/i18n';
export function NpcChatScreen() {
  const locale = useLocale();
  return <StubScreen title={translate('ui.npcChat.title', locale)} />;
}
