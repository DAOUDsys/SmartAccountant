import { ChatThreadScreen } from '../../src/features/chat';
import { AuthenticatedRoute } from '../../src/features/auth';

export default function ChatThreadRoute() {
  return (
    <AuthenticatedRoute>
      <ChatThreadScreen />
    </AuthenticatedRoute>
  );
}
