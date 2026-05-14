"""Seed — dados iniciais para o CRM."""
from models import db, Pipeline, Stage, Contact, Company, Deal, CustomField
from app import create_app


def seed():
    app = create_app()
    with app.app_context():
        db.create_all()

        # Pipeline padrão
        if Pipeline.query.first():
            print("Seed já existe, pulando...")
            return

        pipe = Pipeline(name="Vendas", is_default=True, sort_order=0)
        db.session.add(pipe)
        db.session.flush()

        stages = [
            Stage(pipeline_id=pipe.id, name="Novo Lead",    color="#3b82f6", sort_order=0),
            Stage(pipeline_id=pipe.id, name="Contato",      color="#f59e0b", sort_order=1),
            Stage(pipeline_id=pipe.id, name="Proposta",     color="#8b5cf6", sort_order=2),
            Stage(pipeline_id=pipe.id, name="Negociação",   color="#ec4899", sort_order=3),
            Stage(pipeline_id=pipe.id, name="Fechado ✓",    color="#10b981", sort_order=4, is_won=True),
            Stage(pipeline_id=pipe.id, name="Perdido ✗",    color="#ef4444", sort_order=5, is_lost=True),
        ]
        db.session.add_all(stages)
        db.session.flush()

        # Empresas
        companies = [
            Company(name="Tech Solutions Ltda", website="techsol.com.br", industry="Tecnologia"),
            Company(name="Marketing Pro SA", website="marketingpro.com.br", industry="Marketing"),
            Company(name="Construções ABC", website="", industry="Construção"),
        ]
        db.session.add_all(companies)
        db.session.flush()

        # Contatos
        contacts = [
            Contact(name="João Silva", email="joao@techsol.com.br", phone="(11) 99999-1111",
                    company_id=companies[0].id, avatar_color="#4f46e5"),
            Contact(name="Maria Oliveira", email="maria@marketingpro.com.br", phone="(21) 98888-2222",
                    company_id=companies[1].id, avatar_color="#ec4899"),
            Contact(name="Carlos Santos", email="carlos@gmail.com", phone="(31) 97777-3333",
                    company_id=companies[2].id, avatar_color="#10b981"),
            Contact(name="Ana Costa", email="ana@techsol.com.br", phone="(11) 96666-4444",
                    company_id=companies[0].id, avatar_color="#f59e0b"),
            Contact(name="Pedro Lima", email="pedro@startup.io", phone="(41) 95555-5555",
                    avatar_color="#8b5cf6"),
        ]
        db.session.add_all(contacts)
        db.session.flush()

        # Deals
        deals = [
            Deal(title="Website Corporativo", value=15000, stage_id=stages[0].id,
                 contact_id=contacts[0].id, company_id=companies[0].id),
            Deal(title="Campanha Digital Q3", value=8000, stage_id=stages[1].id,
                 contact_id=contacts[1].id, company_id=companies[1].id),
            Deal(title="App Mobile", value=45000, stage_id=stages[2].id,
                 contact_id=contacts[0].id, company_id=companies[0].id),
            Deal(title="Consultoria SEO", value=5000, stage_id=stages[3].id,
                 contact_id=contacts[4].id),
            Deal(title="Sistema ERP", value=120000, stage_id=stages[0].id,
                 contact_id=contacts[2].id, company_id=companies[2].id),
            Deal(title="Redesign Landing Page", value=3500, stage_id=stages[4].id,
                 contact_id=contacts[3].id, company_id=companies[0].id),
            Deal(title="Gestão de Redes Sociais", value=2000, stage_id=stages[5].id,
                 contact_id=contacts[1].id, company_id=companies[1].id),
        ]
        db.session.add_all(deals)

        # Campos customizados de exemplo
        cf = [
            CustomField(entity_type="contact", name="CPF", field_type="text", sort_order=0),
            CustomField(entity_type="contact", name="Cidade", field_type="text", sort_order=1),
            CustomField(entity_type="company", name="CNPJ", field_type="text", sort_order=0),
            CustomField(entity_type="company", name="Nº Funcionários", field_type="select",
                        options='["1-10","11-50","51-200","200+"]', sort_order=1),
            CustomField(entity_type="deal", name="Probabilidade", field_type="select",
                        options='["10%","25%","50%","75%","90%"]', sort_order=0),
            CustomField(entity_type="deal", name="Fonte do Lead", field_type="select",
                        options='["Website","Indicação","Google Ads","Facebook Ads","Cold Call","Outro"]',
                        sort_order=1),
        ]
        db.session.add_all(cf)

        db.session.commit()
        print("Seed OK! Pipeline + dados de exemplo criados.")


if __name__ == "__main__":
    seed()
