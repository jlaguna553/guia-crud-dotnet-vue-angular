// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://guia-crud-dotnet-vue-angular.vercel.app',
	integrations: [
		starlight({
			title: 'Pedidos CRUD',
			description:
				'Guía práctica paso a paso: construye un CRUD con .NET y con Vue o Angular a elección, y luego cámbialo a SQLite.',
			customCss: ['./src/styles/custom.css'],
			social: [
				{
					icon: 'github',
					label: 'Repositorio',
					href: 'https://github.com/jlaguna553/guia-crud-dotnet-vue-angular',
				},
			],
			sidebar: [
				{
					label: 'Empezar',
					items: [{ label: 'Bienvenida y entorno', slug: 'index' }],
				},
				{
					label: 'El backend',
					items: [
						{ label: 'Parte 1 · API en .NET', slug: 'guia/parte-1-backend' },
						{ label: 'Parte 2 · Elige tu camino', slug: 'guia/parte-2-elige-camino' },
					],
				},
				{
					label: 'Frontend',
					items: [
						{
							label: 'Parte 3 · Con Vue',
							slug: 'guia/parte-3-vue',
							badge: { text: 'Vue', variant: 'success' },
						},
						{
							label: 'Parte 3 · Con Angular',
							slug: 'guia/parte-3-angular',
							badge: { text: 'Angular', variant: 'danger' },
						},
					],
				},
				{
					label: 'Avanzado',
					items: [
						{ label: 'Parte 4 · Conectando todo', slug: 'guia/parte-4-conectando' },
						{ label: 'Parte 5 · Base de datos con SQLite', slug: 'guia/parte-5-sqlite' },
						{ label: 'Parte 6 · Siguientes pasos', slug: 'guia/parte-6-siguientes-pasos' },
					],
				},
			],
		}),
	],
});
