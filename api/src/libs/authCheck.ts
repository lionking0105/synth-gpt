import middy from "@middy/core";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { JwtRsaVerifier } from "aws-jwt-verify";
import { formatJSONResponse } from "@libs/api-gateway";

const verifier = JwtRsaVerifier.create({
	issuer: process.env.JWT_ISSUER_DOMAIN,
	audience: process.env.JWT_AUDIENCE,
	jwksUri: process.env.JWT_JWKS_URI
});

const authCheck = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {

	const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
		request
	): Promise<APIGatewayProxyResult> => {
		const { routeKey } = request.event.requestContext;
		if (routeKey === "$connect" || routeKey === "$userMessage" || routeKey === "$disconnect")
			return;

		const authorization = request.event.headers["authorization"];
		const jwt = authorization.replace("Bearer ", "");
		try {
			await verifier.verify(jwt);
		}
		catch {
			return formatJSONResponse<BaseResponseBody>(null, 401);
		}
	};

	return {
		before
	};
};

export default authCheck;