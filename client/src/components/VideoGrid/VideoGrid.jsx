import VideoTile from '../VideoTile/VideoTile';

export default function VideoGrid({ localStream, localName, participants, presenter, isCameraOff, isMuted }) {
  const remoteList = Object.entries(participants); // [socketId, data]
  const totalCount = remoteList.length + 1; // + local user

  // If someone is presenting, show their stream large + everyone else in a side strip
  if (presenter) {
    const presenterEntry = remoteList.find(([, p]) => p.userId === presenter.userId);
    const presenterStream = presenter.socketId === 'local' ? localStream : presenterEntry?.[1]?.stream;
    const presenterName = presenter.userName;

    const others = remoteList.filter(([, p]) => p.userId !== presenter.userId);

    return (
      <div className="presenter-layout">
        <div className="presenter-main">
          <VideoTile
            stream={presenterStream}
            name={`${presenterName} (Presentation)`}
            isLocal={presenter.socketId === 'local'}
            isPresenter
            muted={false}
            cameraOff={false}
          />
        </div>
        <div className="presenter-sidebar">
          {presenter.socketId !== 'local' && (
            <VideoTile stream={localStream} name={localName} isLocal muted={isMuted} cameraOff={isCameraOff} />
          )}
          {others.map(([socketId, p]) => (
            <VideoTile
              key={socketId}
              stream={p.stream}
              name={p.userName}
              isLocal={false}
              muted={p.muted}
              cameraOff={p.cameraOff}
            />
          ))}
        </div>
      </div>
    );
  }

  // Normal grid — dynamic columns based on participant count
  const getGridClass = (count) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4 grid-rows-4';
  };

  return (
    <div className={`video-grid ${getGridClass(totalCount)}`}>
      <VideoTile stream={localStream} name={localName} isLocal muted={isMuted} cameraOff={isCameraOff} />
      {remoteList.map(([socketId, p]) => (
        <VideoTile
          key={socketId}
          stream={p.stream}
          name={p.userName}
          isLocal={false}
          muted={p.muted}
          cameraOff={p.cameraOff}
        />
      ))}
    </div>
  );
}
