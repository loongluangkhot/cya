interface ChatBubbleProps {
  text: string;
}

export default function ChatBubble({ text }: ChatBubbleProps) {
  return (
    <div className="chat-bubble" role="status">
      <span>{text}</span>
      <div className="bubble-tail" />
    </div>
  );
}
