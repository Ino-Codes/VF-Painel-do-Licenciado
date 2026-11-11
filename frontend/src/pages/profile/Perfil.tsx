import React, { useState, useEffect } from "react";
import { IMaskInput } from "react-imask";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { REGRA_SENHA, validarSenha } from "../../utils/senha.ts";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import CertificadosExternos from "../../components/profile/CertificadosExternos.tsx";
import CertificadosCursos from "../../components/profile/CertificadosCursos.tsx";
import AvatarModal from "../../components/forms/AvatarModal.tsx";
import CapaModal from "../../components/forms/CapaModal.tsx";
import PraiseCard, { Praise } from "../../components/praises/PraiseCard.tsx";
import {
  mesCurto,
  mesTitulo,
} from "../../components/praises/praiseMonths.ts";
import {
  dataBR,
  iconeDoTipo,
  nomeDoAtivo,
  rotuloNumeroSerie,
  AssetCategoria,
} from "../../components/itAssets/assetConfig.ts";
import { IconType } from "react-icons";
import {
  FiUser,
  FiHeart,
  FiMonitor,
  FiAward,
  FiCompass,
  FiLock,
  FiLogOut,
  FiCamera,
  FiEdit2,
} from "react-icons/fi";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface MyAsset {
  id: number;
  tipo_nome: string;
  categoria: AssetCategoria;
  patrimonio: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  responsavel_desde: string | null;
}

interface User {
  id: number;
  email: string;
  nome: string;
  role: "admin" | "licenciado" | "colaborador";
  group_name?: string | null;
  avatar_url?: string;
  cover_url?: string | null;
  cargo?: string;
  setor?: string;
  unit_id?: number;
  unidade_id?: number;
  unidade?: string;
  telefone?: string;
  data_admissao?: string;
  nickname?: string;
}

// Seções do menu lateral. A seção aberta fica na URL (?secao=seguranca),
// então dá para mandar um link direto para ela.
type Secao =
  | "perfil"
  | "elogios"
  | "equipamentos"
  | "certificados"
  | "comportamental"
  | "seguranca";

interface ItemMenu {
  id: Secao;
  rotulo: string;
  Icone: IconType;
  contagem?: number;
  soInterno?: boolean;
}

const soDigitos = (v?: string | null) => (v || "").replace(/\D/g, "");

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .map((p) => p[0]!.toUpperCase())
    .join("");

// ─── Componente ───────────────────────────────────────────────────────────────

const Perfil: React.FC = () => {
  const { user, login, logout, loading, hasPermission } = useAuth() as {
    user: User | null;
    login: (u: any, t?: string) => void;
    logout: () => void;
    loading: boolean;
    hasPermission: (key: string) => boolean;
  };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isCapaModalOpen, setIsCapaModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [myPraises, setMyPraises] = useState<Praise[]>([]);
  const [myAssets, setMyAssets] = useState<MyAsset[]>([]);
  // Mês em foco nos elogios (null = o mais recente) e se a lista do mês está
  // aberta além dos primeiros.
  const [praiseMonth, setPraiseMonth] = useState<string | null>(null);
  const [showAllPraises, setShowAllPraises] = useState(false);
  // Edição direta nos campos: a barra de salvar aparece quando algo muda.
  const [editForm, setEditForm] = useState({ telefone: "", nickname: "" });
  const [salvando, setSalvando] = useState(false);

  const interno = hasPermission("internal_access");

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && user) {
      setEditForm({
        telefone: user.telefone || "",
        nickname: user.nickname || "",
      });
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Elogios recebidos (pessoa ou setor) — somente colaboradores internos.
  useEffect(() => {
    if (!user || !interno) return;
    api
      .get("/api/praises/mine")
      .then((res) => setMyPraises(res.data as Praise[]))
      .catch(() => setMyPraises([]));
  }, [user, interno]);

  // Equipamentos do Inventário de TI sob a responsabilidade do colaborador.
  useEffect(() => {
    if (!user || !interno) return;
    api
      .get("/api/it-assets/mine")
      .then((res) => setMyAssets(res.data as MyAsset[]))
      .catch(() => setMyAssets([]));
  }, [user, interno]);

  // ─── Menu ───────────────────────────────────────────────────────────────────

  const itensMenu: ItemMenu[] = [
    { id: "perfil", rotulo: "Meu perfil", Icone: FiUser },
    { id: "elogios", rotulo: "Elogios", Icone: FiHeart, contagem: myPraises.length, soInterno: true },
    { id: "equipamentos", rotulo: "Equipamentos", Icone: FiMonitor, contagem: myAssets.length, soInterno: true },
    { id: "certificados", rotulo: "Certificados", Icone: FiAward },
    { id: "comportamental", rotulo: "Perfil comportamental", Icone: FiCompass, soInterno: true },
    { id: "seguranca", rotulo: "Segurança", Icone: FiLock },
  ].filter((i) => !i.soInterno || interno) as ItemMenu[];

  const pedida = searchParams.get("secao") as Secao | null;
  const secao: Secao = itensMenu.some((i) => i.id === pedida) ? pedida! : "perfil";
  const abrirSecao = (id: Secao) =>
    setSearchParams(id === "perfil" ? {} : { secao: id }, { replace: true });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const alterado =
    !!user &&
    (editForm.nickname.trim() !== (user.nickname || "") ||
      (interno && soDigitos(editForm.telefone) !== soDigitos(user.telefone)));

  const descartarAlteracoes = () => {
    if (!user) return;
    setEditForm({ telefone: user.telefone || "", nickname: user.nickname || "" });
  };

  const handleSaveChanges = async () => {
    if (!user || salvando) return;

    // Nome, e-mail, cargo e setor são mantidos pelo RH: vão como estão.
    const payload: any = {
      ...user,
      data_admissao: user.data_admissao,
      nickname: editForm.nickname.trim() || null,
    };
    if (interno) payload.telefone = soDigitos(editForm.telefone);

    setSalvando(true);
    try {
      const res = await api.put(`/api/users/admin/${user.id}`, payload);
      login(res.data.user, res.data.token);
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || trocandoSenha) return;

    if (newPassword !== confirmPassword) {
      toast.error("A nova senha e a confirmação não correspondem.");
      return;
    }
    const erroSenha = validarSenha(newPassword, user.email);
    if (erroSenha) {
      toast.error(erroSenha);
      return;
    }

    setTrocandoSenha(true);
    try {
      const res = await api.put(`/api/users/${user.id}/change-password`, {
        currentPassword,
        newPassword,
      });
      // A troca encerra as outras sessões; esta segue com o token novo.
      if (res.data?.token) login(res.data.user, res.data.token);
      toast.success("Senha alterada com sucesso! Outras sessões abertas foram encerradas.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao alterar a senha.");
    } finally {
      setTrocandoSenha(false);
    }
  };

  const handleConfirmRemoveAvatar = async () => {
    if (!user) return;
    try {
      const res = await api.delete(`/api/users/${user.id}/avatar`);
      login(res.data.user, res.data.token);
      toast.success("Foto de perfil removida com sucesso!");
    } catch (err) {
      toast.error("Erro ao remover a foto.");
    } finally {
      setIsConfirmModalOpen(false);
    }
  };

  // ─── Elogios ──────────────────────────────────────────────────────────────

  // Quantos elogios do mês aparecem antes do "Ver mais".
  const PRAISES_VISIVEIS = 6;

  // Meses com elogios, do mais recente ao mais antigo (a lista já vem
  // ordenada por competência do backend; aqui só tiramos as repetições).
  const praiseMonths = myPraises.reduce<string[]>((acc, p) => {
    const mes = p.reference_month || "";
    if (mes && !acc.includes(mes)) acc.push(mes);
    return acc;
  }, []);

  const praiseMonthAtivo = praiseMonth || praiseMonths[0] || null;

  const praisesDoMes = myPraises.filter(
    (p) => !praiseMonthAtivo || p.reference_month === praiseMonthAtivo,
  );

  const praisesVisiveis = showAllPraises
    ? praisesDoMes
    : praisesDoMes.slice(0, PRAISES_VISIVEIS);

  const praisesRestantes = praisesDoMes.length - praisesVisiveis.length;

  const trocarMesElogios = (mes: string) => {
    setPraiseMonth(mes);
    // Mês novo começa recolhido, senão a lista voltaria a ser longa.
    setShowAllPraises(false);
  };

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  const subtitulo = [interno ? user.setor : null, interno ? user.cargo : null, user.email]
    .filter(Boolean)
    .join(" · ");

  // ─── Seções ───────────────────────────────────────────────────────────────

  const secaoPerfil = (
    <>
      <header className="perfil-secao-topo">
        <h2>Meu perfil</h2>
        <p>Edite direto nos campos. O que é mantido pelo RH aparece bloqueado.</p>
      </header>

      <article className="perfil-card">
        <h3 className="perfil-card-titulo">Dados pessoais</h3>
        <div className="perfil-campos">
          <CampoBloqueado rotulo="Nome completo" valor={user.nome} />
          <div className="perfil-campo">
            <label htmlFor="perfil-apelido">Apelido</label>
            <input
              id="perfil-apelido"
              type="text"
              className="form-input"
              placeholder="Como você prefere ser chamado"
              maxLength={40}
              value={editForm.nickname}
              onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
            />
          </div>
          <CampoBloqueado rotulo="E-mail" valor={user.email} />
          {interno && (
            <div className="perfil-campo">
              <label htmlFor="perfil-telefone">Telefone</label>
              <IMaskInput
                id="perfil-telefone"
                mask="(00) 00000-0000"
                value={editForm.telefone}
                onAccept={(value: any) => setEditForm((f) => ({ ...f, telefone: value }))}
                type="tel"
                className="form-input"
                placeholder="(00) 00000-0000"
              />
            </div>
          )}
        </div>
      </article>

      {interno && (
        <article className="perfil-card">
          <div className="perfil-card-titulo perfil-card-titulo--com-nota">
            <h3>Dados profissionais</h3>
            <span>Mantidos pelo RH</span>
          </div>
          <dl className="perfil-dados-rh">
            <div>
              <dt>Cargo</dt>
              <dd>{user.cargo || "Não informado"}</dd>
            </div>
            <div>
              <dt>Setor</dt>
              <dd>{user.setor || "Não informado"}</dd>
            </div>
            <div>
              <dt>Grupo de acesso</dt>
              <dd>{user.group_name || "—"}</dd>
            </div>
          </dl>
        </article>
      )}

      {alterado && (
        <div className="perfil-barra-salvar" role="status">
          <span>Você tem alterações não salvas.</span>
          <button type="button" className="perfil-barra-salvar-descartar" onClick={descartarAlteracoes} disabled={salvando}>
            Descartar
          </button>
          <button type="button" className="perfil-barra-salvar-salvar" onClick={handleSaveChanges} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      )}
    </>
  );

  const secaoElogios = (
    <>
      <header className="perfil-secao-topo">
        <h2>Elogios</h2>
        <p>Reconhecimentos recebidos por você ou pelo seu setor. Quem escreveu permanece anônimo.</p>
      </header>
      <article className="perfil-card">
        {myPraises.length === 0 ? (
          <p className="perfil-vazio">Você ainda não recebeu elogios.</p>
        ) : (
          <>
            {praiseMonths.length > 1 && (
              <div className="praise-month-tabs" role="tablist" aria-label="Mês dos elogios">
                {praiseMonths.map((mes) => (
                  <button
                    key={mes}
                    type="button"
                    role="tab"
                    aria-selected={mes === praiseMonthAtivo}
                    className={`praise-month-tab${mes === praiseMonthAtivo ? " praise-month-tab--active" : ""}`}
                    onClick={() => trocarMesElogios(mes)}
                  >
                    <span className="praise-month-tab-label">{mesCurto(mes)}</span>
                    <span className="praise-month-tab-count">
                      {myPraises.filter((p) => p.reference_month === mes).length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="praise-month-summary">
              <h4 className="praise-month-title">{mesTitulo(praiseMonthAtivo)}</h4>
              <span className="praise-month-meta">
                {praisesDoMes.length} elogio{praisesDoMes.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="praise-grid praise-grid--testimonial">
              {praisesVisiveis.map((p) => (
                <PraiseCard key={p.id} praise={p} showRecipient={false} variant="testimonial" />
              ))}
            </div>

            {(praisesRestantes > 0 || showAllPraises) && (
              <div className="praise-more-row">
                <button type="button" className="list-button" onClick={() => setShowAllPraises((v) => !v)}>
                  {showAllPraises ? "Ver menos" : `Ver mais (${praisesRestantes})`}
                </button>
              </div>
            )}
          </>
        )}
      </article>
    </>
  );

  const secaoEquipamentos = (
    <>
      <header className="perfil-secao-topo">
        <h2>Equipamentos</h2>
        <p>Equipamentos de TI sob a sua responsabilidade. Se algo estiver diferente, fale com o time de TI.</p>
      </header>
      <article className="perfil-card">
        {myAssets.length === 0 ? (
          <p className="perfil-vazio">Nenhum equipamento sob a sua responsabilidade.</p>
        ) : (
          <ul className="inv-mine">
            {myAssets.map((a) => {
              const Icone = iconeDoTipo(a.categoria);
              return (
                <li key={a.id} className="inv-mine-item">
                  <span className="inv-detail-icon" aria-hidden="true">
                    <Icone />
                  </span>
                  <div>
                    <p className="inv-mine-name">{nomeDoAtivo(a)}</p>
                    <p className="inv-mine-meta">
                      {a.patrimonio
                        ? `Patrimônio ${a.patrimonio}`
                        : a.numero_serie
                          ? `${rotuloNumeroSerie(a.categoria)} ${a.numero_serie}`
                          : a.tipo_nome}
                      {a.responsavel_desde && ` · desde ${dataBR(a.responsavel_desde)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </>
  );

  const secaoCertificados = (
    <>
      <header className="perfil-secao-topo">
        <h2>Certificados</h2>
        <p>Diplomas e cursos feitos fora do Painel, e os certificados dos cursos concluídos aqui.</p>
      </header>
      {/* Certificados de outras organizações, cadastrados pelo usuário */}
      <CertificadosExternos />
      {/* Certificados emitidos pelos cursos do próprio Painel */}
      <CertificadosCursos />
    </>
  );

  const secaoComportamental = (
    <>
      <header className="perfil-secao-topo">
        <h2>Perfil comportamental</h2>
        <p>Teste rápido de Eneagrama sobre seus traços de personalidade e como você interage em equipe.</p>
      </header>
      <article className="perfil-card perfil-destaque">
        <span className="perfil-destaque-icone" aria-hidden="true">
          <FiCompass />
        </span>
        <div className="perfil-destaque-texto">
          <h3>Eneagrama</h3>
          <p>Veja o seu resultado ou responda o teste de novo quando quiser.</p>
        </div>
        <div className="perfil-destaque-acoes">
          <Link to="/perfil/enneagram-results" className="perfil-destaque-primario">
            Ver meu resultado
          </Link>
          <Link to="/enneagram" className="perfil-destaque-secundario">
            Responder teste
          </Link>
        </div>
      </article>
    </>
  );

  const secaoSeguranca = (
    <>
      <header className="perfil-secao-topo">
        <h2>Segurança</h2>
        <p>Ao trocar a senha, as outras sessões abertas são encerradas.</p>
      </header>
      <article className="perfil-card">
        <h3 className="perfil-card-titulo">Alterar senha</h3>
        <form className="perfil-senha" onSubmit={handleChangePassword}>
          <div className="perfil-campo">
            <label htmlFor="current-password">Senha atual</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="perfil-campo">
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="form-input"
              aria-describedby="perfil-regra-senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="perfil-campo">
            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <p id="perfil-regra-senha" className="senha-regra perfil-senha-regra">
            {REGRA_SENHA}
          </p>
          <div className="perfil-senha-acoes">
            <button type="submit" className="form-button" disabled={trocandoSenha}>
              {trocandoSenha ? "Alterando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </article>
    </>
  );

  const conteudo: Record<Secao, React.ReactNode> = {
    perfil: secaoPerfil,
    elogios: secaoElogios,
    equipamentos: secaoEquipamentos,
    certificados: secaoCertificados,
    comportamental: secaoComportamental,
    seguranca: secaoSeguranca,
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area perfil-pagina">
        {/* ── Capa ── */}
        <section className="perfil-capa">
          {/* Faixa 4:1 (1584 × 396, padrão do LinkedIn). Sem imagem própria,
              fica a faixa preta da marca com o filete dourado. */}
          <div className="perfil-capa-faixa">
            {user.cover_url && <img src={user.cover_url} alt="" className="perfil-capa-imagem" />}
            <button
              type="button"
              className="perfil-capa-editar"
              aria-label="Editar capa do perfil"
              title="Editar capa"
              onClick={() => setIsCapaModalOpen(true)}
            >
              <FiEdit2 aria-hidden="true" />
            </button>
          </div>
          <div className="perfil-capa-corpo">
            <div className="perfil-capa-avatar">
              <PerfilAvatar user={user} className="perfil-capa-foto" />
              <button
                type="button"
                className="perfil-capa-camera"
                aria-label="Trocar foto de perfil"
                onClick={() => setIsAvatarModalOpen(true)}
              >
                <FiCamera aria-hidden="true" />
              </button>
            </div>
            <div className="perfil-capa-info">
              <div className="perfil-capa-nome">
                <h1>{user.nome}</h1>
                {user.group_name && <span className="perfil-selo">{user.group_name}</span>}
              </div>
              <p>{subtitulo}</p>
            </div>
          </div>
        </section>

        <div className="perfil-layout">
          {/* ── Menu lateral ── */}
          <nav className="perfil-menu" aria-label="Seções do perfil">
            {itensMenu.map(({ id, rotulo, Icone, contagem }) => (
              <button
                key={id}
                type="button"
                className={`perfil-menu-item${secao === id ? " perfil-menu-item--ativo" : ""}`}
                aria-current={secao === id ? "page" : undefined}
                onClick={() => abrirSecao(id)}
              >
                <Icone aria-hidden="true" className="perfil-menu-icone" />
                <span className="perfil-menu-rotulo">{rotulo}</span>
                {!!contagem && <span className="perfil-menu-contagem">{contagem}</span>}
              </button>
            ))}
            <hr className="perfil-menu-divisor" />
            <button type="button" className="perfil-menu-item perfil-menu-item--sair" onClick={logout}>
              <FiLogOut aria-hidden="true" className="perfil-menu-icone" />
              <span className="perfil-menu-rotulo">Sair da conta</span>
            </button>
          </nav>

          {/* ── Conteúdo da seção ── */}
          <section className="perfil-conteudo">{conteudo[secao]}</section>
        </div>
      </div>

      <Footer />

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmRemoveAvatar}
        title="Remover Foto de Perfil"
        message="Tem certeza que deseja remover sua foto de perfil?"
      />

      <AvatarModal isOpen={isAvatarModalOpen} onClose={() => setIsAvatarModalOpen(false)} />
      <CapaModal isOpen={isCapaModalOpen} onClose={() => setIsCapaModalOpen(false)} />
    </div>
  );
};

// ─── Peças ────────────────────────────────────────────────────────────────────

/** Foto do usuário ou, sem foto, as iniciais do nome. */
const PerfilAvatar: React.FC<{ user: User; className: string }> = ({ user, className }) =>
  user.avatar_url ? (
    <img src={user.avatar_url} alt="" className={className} />
  ) : (
    <span className={`${className} perfil-avatar-iniciais`} aria-hidden="true">
      {iniciais(user.nome || user.email)}
    </span>
  );

/** Campo que só o RH/admin altera: aparece como valor travado. */
const CampoBloqueado: React.FC<{ rotulo: string; valor: string }> = ({ rotulo, valor }) => (
  <div className="perfil-campo">
    <span className="perfil-campo-rotulo">{rotulo}</span>
    <span className="perfil-campo-bloqueado">
      <span className="perfil-campo-bloqueado-valor">{valor}</span>
      <FiLock aria-label="Somente o RH altera" className="perfil-campo-cadeado" />
    </span>
  </div>
);

export default Perfil;
