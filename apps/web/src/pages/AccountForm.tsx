import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { accountsApi } from "../lib/api.js";

export default function AccountForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { name: "", type: "bank", currency: "CNY", description: "" },
  });

  const mutation = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      navigate("/accounts");
    },
  });

  return (
    <div>
      <h2>新建账户</h2>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="form">
        <div className="form-field">
          <label>账户名称 *</label>
          <input {...register("name", { required: "请输入账户名称" })} />
          {errors.name && <span className="error">{errors.name.message}</span>}
        </div>
        <div className="form-field">
          <label>类型</label>
          <select {...register("type")}>
            <option value="bank">银行</option>
            <option value="cash">现金</option>
            <option value="credit">信用卡</option>
            <option value="investment">投资</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div className="form-field">
          <label>币种</label>
          <input {...register("currency")} maxLength={3} />
        </div>
        <div className="form-field">
          <label>描述</label>
          <textarea {...register("description")} rows={3} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "创建中..." : "创建账户"}
          </button>
          <button type="button" className="btn" onClick={() => navigate("/accounts")}>
            取消
          </button>
        </div>
        {mutation.isError && <p className="error">创建失败: {(mutation.error as Error).message}</p>}
      </form>
    </div>
  );
}
