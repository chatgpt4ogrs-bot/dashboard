import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ManagedUser, UserInput } from '../../../shared/auth';
import { UserFormModal } from '../../components/users/UserFormModal';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useI18n } from '../../i18n';
import { getErrorMessage, usersApi } from '../../services/api';
import { formatDateTime } from '../../utils/time';

type FormState = { mode: 'create' } | { mode: 'edit'; user: ManagedUser } | null;
type Feedback = { type: 'success' | 'error'; message: string } | null;

export function UsersPage() {
  const { user: me, retry: refreshSession } = useAuth();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [form, setForm] = useState<FormState>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await usersApi.list());
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = useCallback(() => setForm(null), []);

  const handleSubmit = async (input: UserInput) => {
    if (form?.mode === 'edit') {
      await usersApi.update(form.user.id, input);
      if (form.user.id === me?.id) refreshSession();
      setFeedback({ type: 'success', message: t.users.updated(input.email) });
    } else {
      await usersApi.create(input);
      setFeedback({ type: 'success', message: t.users.created(input.email) });
    }
    setForm(null);
    await load();
  };

  const handleToggleActive = async (user: ManagedUser) => {
    if (user.active) {
      const confirmed = await confirm({
        title: t.users.deactivateTitle,
        message: (
          <>
            {t.users.deactivateMessage} <strong>{user.email}</strong>
            {t.users.deactivateWarning}
          </>
        ),
        confirmLabel: t.users.deactivate,
      });
      if (!confirmed) return;
    }
    try {
      await usersApi.update(user.id, { email: user.email, name: user.name, role: user.role, active: !user.active });
      setFeedback({ type: 'success', message: user.active ? t.users.deactivated(user.email) : t.users.reactivated(user.email) });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    const confirmed = await confirm({
      title: t.users.deleteTitle,
      message: (
        <>
          {t.users.deleteMessage} <strong>{user.email}</strong>
          {t.users.deleteWarning}
        </>
      ),
    });
    if (!confirmed) return;
    try {
      await usersApi.remove(user.id);
      setFeedback({ type: 'success', message: t.users.deleted(user.email) });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
    }
  };

  const activeCount = users.filter((u) => u.active).length;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2 className="section-header__title">{t.users.title}</h2>
          <p className="section-header__subtitle">{loading ? t.common.loading : t.users.summary(users.length, activeCount)}</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
          <UserPlus size={16} /> {t.users.new}
        </button>
      </div>

      {feedback && (
        <p className={`feedback feedback--${feedback.type} page__feedback`} role="status">
          {feedback.message}
        </p>
      )}

      {!loading && users.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.users.column}</th>
                <th>{t.users.role}</th>
                <th>{t.common.status}</th>
                <th>{t.users.lastLogin}</th>
                <th>{t.users.createdAt}</th>
                <th className="table__action">{t.users.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === me?.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <span className={`user-cell__avatar${user.active ? '' : ' user-cell__avatar--inactive'}`}>
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </span>
                        <div className="user-cell__info">
                          <span className="table__strong">
                            {user.name || user.email}
                            {isSelf && <span className="user-cell__you">{t.users.you}</span>}
                          </span>
                          {user.name && <span className="user-cell__email">{user.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{t.roles[user.role]}</td>
                    <td>
                      <button
                        type="button"
                        className={`status status--toggle ${user.active ? 'status--online' : 'status--inactive'}`}
                        onClick={() => handleToggleActive(user)}
                        disabled={isSelf}
                        title={isSelf ? t.users.cannotDeactivateSelf : user.active ? t.users.clickToDeactivate : t.users.clickToReactivate}
                      >
                        <span className="status__dot" />
                        {user.active ? t.users.active : t.users.inactive}
                      </button>
                    </td>
                    <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="muted">{t.users.never}</span>}</td>
                    <td>{formatDateTime(user.createdAt)}</td>
                    <td className="table__action">
                      <div className="table__buttons">
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          onClick={() => setForm({ mode: 'edit', user })}
                          title={t.common.edit}
                          aria-label={t.users.editUser(user.email)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm icon-btn--danger"
                          onClick={() => handleDelete(user)}
                          disabled={isSelf}
                          title={isSelf ? t.users.cannotDeleteSelf : t.common.delete}
                          aria-label={t.users.deleteUser(user.email)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <UserFormModal
          key={form.mode === 'edit' ? form.user.id : 'new'}
          user={form.mode === 'edit' ? form.user : null}
          isSelf={form.mode === 'edit' && form.user.id === me?.id}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}
