type Props = {
  title?: string;
  message?: string;
};

export default function AuthRequired({
  title = 'Private member access',
  message = 'Use the private invite link shared by an organizer to sign in.'
}: Props) {
  return (
    <div className="card p-6" role="status">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-braga-100">{message}</p>
      <a className="btn-primary mt-5 inline-flex" href="/signin">Existing member sign in</a>
    </div>
  );
}
