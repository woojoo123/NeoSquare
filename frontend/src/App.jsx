import AuthBootstrap from './components/AuthBootstrap';
import AppRouter from './router';

export default function App() {
  return (
    <AuthBootstrap>
      <AppRouter />
    </AuthBootstrap>
  );
}
