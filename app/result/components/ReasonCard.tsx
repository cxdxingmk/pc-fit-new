type Props = {
  reason: string[];
};

export default function ReasonCard({ reason }: Props) {
  return (
    <div className="rounded-2xl border bg-blue-50 p-6 shadow-md">
      <h2 className="mb-4 text-2xl font-bold">
        🤖 AI 추천 이유
      </h2>

      <div className="space-y-3 leading-8 text-gray-700">
        {reason.map((item, index) => (
          <p key={index}>{item}</p>
        ))}
      </div>
    </div>
  );
}