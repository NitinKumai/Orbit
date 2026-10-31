import React from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Users,
  Link,
  PhoneOff,
} from "lucide-react";
import IconButton from "./IconButton";

interface ControlBarProps {
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onChat: () => void;
  onParticipants: () => void;
  onCopyLink: () => void;
  onLeave: () => void;
}

export default function ControlBar({
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onShareScreen,
  onChat,
  onParticipants,
  onCopyLink,
  onLeave,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      <IconButton
        label={micOn ? "Turn microphone off" : "Turn microphone on"}
        active={!micOn}
        onClick={onToggleMic}
      >
        {micOn ? <Mic size={19} /> : <MicOff size={19} />}
      </IconButton>

      <IconButton
        label={cameraOn ? "Turn camera off" : "Turn camera on"}
        active={!cameraOn}
        onClick={onToggleCamera}
      >
        {cameraOn ? <Video size={19} /> : <VideoOff size={19} />}
      </IconButton>

      <IconButton
        label="Share screen"
        onClick={onShareScreen}
      >
        <MonitorUp size={19} />
      </IconButton>

      <IconButton
        label="Participants"
        onClick={onParticipants}
      >
        <Users size={19} />
      </IconButton>

      <IconButton
        label="Chat"
        onClick={onChat}
      >
        <MessageSquare size={19} />
      </IconButton>

      <IconButton
        label="Copy meeting link"
        onClick={onCopyLink}
      >
        <Link size={19} />
      </IconButton>

      <IconButton
        label="Leave meeting"
        danger
        onClick={onLeave}
      >
        <PhoneOff size={19} />
      </IconButton>
    </div>
  );
}