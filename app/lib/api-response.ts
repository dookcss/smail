// 统一 API JSON 响应格式

export function ok<T>(data: T, status = 200) {
	return Response.json({ success: true, data, error: null }, { status });
}

export function error(message: string, status = 400) {
	return Response.json({ success: false, data: null, error: message }, { status });
}

export function paginated<T>(items: T[], page: number, limit: number, total: number) {
	return ok({
		items,
		pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
	});
}