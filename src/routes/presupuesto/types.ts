export type Category = {
	id: number;
	name: string;
	unit_price: number;
};

export type Study = {
	id: number;
	name: string;
	category_id: number;
};
