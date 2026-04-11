export default function RouteLoadingFallback({ message = '화면을 불러오는 중입니다...' }) {
  return (
    <div className="route-loading">
      <div className="route-loading__panel">
        <span className="route-loading__badge">NeoSquare</span>
        <h1>잠시만 기다려 주세요</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}
