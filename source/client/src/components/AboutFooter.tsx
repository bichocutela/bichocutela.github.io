const aboutLinks = [
  { label: "Site", url: "https://www.nordestaomaisvoce.com.br/" },
  { label: "App Nossa Gente", url: "https://app.nordestao.com.br/" },
  { label: "Nordestão Pra Você", url: "https://pravoce.nordestao.com.br/home" },
  { label: "Encarte", url: "https://pravoce.nordestao.com.br/tabloids" },
] as const;

function copyrightYear() {
  const year = new Date().getFullYear();
  return year <= 2026 ? "2026" : `2026-${year}`;
}

export default function AboutFooter() {
  return (
    <section className="nrd-about-footer" aria-labelledby="nrd-about-title">
      <div className="nrd-about-footer__inner">
        <p className="nrd-about-footer__eyebrow">Sobre</p>
        <h2 id="nrd-about-title">Sobre o Aplicativo</h2>

        <div className="nrd-about-footer__copy">
          <p>
            Este aplicativo foi desenvolvido por Alessandro P., Operador de Caixa, com o objetivo de auxiliar os colaboradores da Frente de Loja na consulta rápida de códigos correlatos, contribuindo para mais agilidade, precisão e eficiência no atendimento aos clientes.
          </p>
          <p>
            Este projeto nasceu da vivência diária na operação de caixa e da necessidade de tornar a rotina de trabalho mais prática, oferecendo uma ferramenta de apoio aos profissionais da equipe.
          </p>
          <p>
            Registro meu sincero agradecimento aos Fiscais de Caixa, pela confiança, incentivo e apoio durante o desenvolvimento desta iniciativa, bem como aos colegas de trabalho, que compartilharam sugestões, experiências e conhecimentos que contribuíram para o aprimoramento do aplicativo.
          </p>
          <p>
            Este aplicativo foi desenvolvido exclusivamente como uma ferramenta de apoio operacional interno e não substitui os procedimentos, normas, orientações ou sistemas oficiais da empresa.
          </p>
          <p>
            Todas as marcas, nomes, logotipos, códigos, informações e demais conteúdos relacionados ao Supermercado Nordestão pertencem aos seus respectivos proprietários. Todos os direitos são reservados à empresa. O desenvolvedor não reivindica qualquer direito de propriedade sobre essas informações, utilizando-as unicamente para fins de apoio às atividades internas dos colaboradores.
          </p>
          <p>
            © {copyrightYear()} Alessandro P. Todos os direitos do aplicativo são reservados ao autor. O conteúdo institucional e as informações pertencentes ao Supermercado Nordestão permanecem de propriedade exclusiva da empresa.
          </p>
        </div>

        <div className="nrd-about-footer__meta">
          <span><strong>Versão:</strong> PWA</span>
          <span><strong>Desenvolvedor:</strong> Alessandro Paulo</span>
          <span>@bichocutela · @haydendanex</span>
        </div>

        <nav className="nrd-about-footer__links" aria-label="Links oficiais">
          {aboutLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              <span>{link.label}</span>
              <small>{link.url}</small>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
