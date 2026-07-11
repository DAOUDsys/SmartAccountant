import { ConversationListScreen } from '../src/features/chat';
import { AuthenticatedRoute } from '../src/features/auth';

export default function ConversationsRoute() {
  return (
    <AuthenticatedRoute>
      <ConversationListScreen />
    </AuthenticatedRoute>
  );
}
